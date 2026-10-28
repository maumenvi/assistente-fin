import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { OpenAiCompatLlm } from '../../../src/libs/llm/openai-compat/openai.compat.llm.ts';
import { resolveCapabilities } from '../../../src/libs/llm/resolve.capabilities.ts';
import { microToUsdString } from '../../../src/domain/agent/micro.to.usd.string.ts';
import { RecordingLlm } from './recording.llm.ts';
import { fixtureLlmFactory, FIXTURES_ROOT, runSuite, type LlmFactory } from './run.suite.ts';
import { renderEvalReport, type EvalReport } from './score.report.ts';
import { compareBaseline, renderBaselineComparison } from './report/compare.baseline.ts';
import { ALL_SCENARIOS } from './scenarios/all.scenarios.ts';
import { type ScenarioCategory } from './scenarios/eval.scenario.ts';
import { renderCapabilityReport, runCapabilitySuite } from './capability/run.capability.suite.ts';
import { renderCompactionReport, runCompactionSuite } from './compaction/run.compaction.suite.ts';
import { renderWriteReport, runWriteSuite } from './write/run.write.suite.ts';

/** Argumentos da linha de comando de `npm run agent:evals`. */
export interface EvalArgs {
  readonly model: string;
  readonly live: boolean;
  readonly record: boolean;
  readonly only: ScenarioCategory | null;
  readonly yes: boolean;
  /** Grava tambem o relatorio em `report/baseline/` (linha de base da spec 037, comparada depois por `--compare`). */
  readonly baseline: boolean;
  /** Compara a execucao atual com a linha de base de `baseline/<model>.json` (spec 037, T046). */
  readonly compare: boolean;
  /** `pipeline` (padrao, spec 031) ou `compaction` (fidelidade pos-compactacao, spec 032). */
  readonly suite: 'pipeline' | 'compaction' | 'write' | 'capability';
}

const CATEGORIES = new Set(ALL_SCENARIOS.map((s) => s.category));

/** Custo estimado por cenario ao vivo (duas chamadas curtas), em micro-dolares, para o aviso antes de gastar. */
const ESTIMATED_MICRO_PER_SCENARIO = 10_000;

/** Interpreta os argumentos; devolve o motivo em texto quando invalidos. */
export function parseEvalArgs(argv: readonly string[]): EvalArgs | { readonly error: string } {
  let model = 'pipeline';
  let live = false;
  let record = false;
  let only: ScenarioCategory | null = null;
  let yes = false;
  let baseline = false;
  let compare = false;
  let suite: EvalArgs['suite'] = 'pipeline';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--live') live = true;
    else if (arg === '--record') record = true;
    else if (arg === '--yes') yes = true;
    else if (arg === '--baseline') baseline = true;
    else if (arg === '--compare') compare = true;
    else if (arg === '--suite') {
      const value = argv[i + 1];
      if (value !== 'pipeline' && value !== 'compaction' && value !== 'write' && value !== 'capability') return { error: '--suite exige pipeline, compaction, write ou capability' };
      suite = value;
      i += 1;
    } else if (arg === '--model' || arg === '--only') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} exige um valor` };
      i += 1;
      if (arg === '--model') model = value;
      else if (CATEGORIES.has(value as ScenarioCategory)) only = value as ScenarioCategory;
      else return { error: `categoria desconhecida: ${value} (use ${[...CATEGORIES].join(', ')})` };
    } else return { error: `argumento desconhecido: ${arg}` };
  }
  if (record && !live) return { error: '--record exige --live (so grava respostas de um modelo real)' };
  if (suite === 'write' && (live || record)) return { error: 'a suite write roda so offline (o modelo correto vem do gabarito; modelos reais entram em outra etapa)' };
  if (suite === 'capability' && (live || record)) return { error: 'a suite capability roda so offline (o modelo correto vem do gabarito; modelos reais entram em outra etapa)' };
  if (suite === 'compaction' && (live || record)) return { error: 'a suite compaction roda so offline (as fixtures de modelo real da compactacao entram em outra etapa)' };
  if (live && model === 'pipeline') return { error: '--live exige --model <id do modelo no OpenRouter>' };
  if (baseline && (live || record || suite !== 'pipeline')) return { error: '--baseline vale so para a suite pipeline offline' };
  if (compare && suite !== 'pipeline') return { error: '--compare vale so para a suite pipeline' };
  return { model, live, record, only, yes, baseline, compare, suite };
}

/** Nome de diretorio de fixtures para um modelo (`anthropic/claude` -> `anthropic__claude`). */
export function modelDirName(model: string): string {
  return model.replace(/[^A-Za-z0-9._-]+/g, '__');
}

/** Dependencias injetaveis da CLI (testes e ambiente). */
export interface EvalCliDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly out: (line: string) => void;
  readonly confirm: (question: string) => Promise<boolean>;
  readonly reportDir: string;
  readonly baselineDir?: string;
  readonly fixturesDir: string;
}

/** Dependencias reais: terminal, variaveis de ambiente e pastas do projeto. */
export function defaultEvalCliDeps(): EvalCliDeps {
  return {
    env: process.env,
    out: (line) => console.log(line),
    confirm: async (question) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return /^s(im)?$/i.test((await rl.question(`${question} [s/N] `)).trim());
      } finally {
        rl.close();
      }
    },
    reportDir: join(import.meta.dirname, 'report'),
    baselineDir: join(import.meta.dirname, 'baseline'),
    fixturesDir: FIXTURES_ROOT,
  };
}

/** Executa a CLI; devolve o codigo de saida (0 aprovado, 1 limiar violado, 2 uso invalido). */
export async function runEvalCli(argv: readonly string[], deps: EvalCliDeps): Promise<number> {
  const args = parseEvalArgs(argv);
  if ('error' in args) {
    deps.out(`erro: ${args.error}`);
    return 2;
  }
  if (args.suite === 'compaction') {
    const { report } = await runCompactionSuite();
    mkdirSync(deps.reportDir, { recursive: true });
    writeFileSync(join(deps.reportDir, 'compaction.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(deps.reportDir, 'compaction.md'), renderCompactionReport(report));
    deps.out(renderCompactionReport(report));
    return report.ok ? 0 : 1;
  }
  if (args.suite === 'capability') {
    const { report } = await runCapabilitySuite();
    mkdirSync(deps.reportDir, { recursive: true });
    writeFileSync(join(deps.reportDir, 'capability.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(deps.reportDir, 'capability.md'), renderCapabilityReport(report));
    deps.out(renderCapabilityReport(report));
    return report.ok ? 0 : 1;
  }
  if (args.suite === 'write') {
    const { report } = await runWriteSuite();
    mkdirSync(deps.reportDir, { recursive: true });
    writeFileSync(join(deps.reportDir, 'write.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(deps.reportDir, 'write.md'), renderWriteReport(report));
    deps.out(renderWriteReport(report));
    return report.ok ? 0 : 1;
  }
  const scenarios = args.only === null ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => s.category === args.only);
  const dirName = modelDirName(args.model);
  const recorders = new Map<string, RecordingLlm>();
  let llmFor: LlmFactory;
  if (args.live) {
    const apiKey = deps.env['OPENROUTER_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      deps.out('erro: defina OPENROUTER_API_KEY para rodar ao vivo');
      return 2;
    }
    deps.out(`Ao vivo: ${scenarios.length} cenários com ${args.model} — custo estimado de ${microToUsdString(scenarios.length * ESTIMATED_MICRO_PER_SCENARIO)}.`);
    if (!args.yes && !(await deps.confirm('Continuar e gastar créditos?'))) {
      deps.out('cancelado');
      return 2;
    }
    llmFor = (scenario) => {
      const real = new OpenAiCompatLlm({
        baseUrl: 'https://openrouter.ai/api/v1',
        model: args.model,
        apiKey,
        capabilities: resolveCapabilities({ modelId: args.model }),
        fetchFn: (url, init) => fetch(url, init),
        extraHeaders: { 'X-Title': 'Assistente Fin (avaliacao)' },
      });
      if (!args.record) return real;
      const recorder = new RecordingLlm(real);
      recorders.set(scenario.id, recorder);
      return recorder;
    };
  } else {
    llmFor = fixtureLlmFactory(dirName);
  }

  const { report } = await runSuite({ model: args.model, llmFor, scenarios });
  mkdirSync(deps.reportDir, { recursive: true });
  writeFileSync(join(deps.reportDir, `${dirName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(deps.reportDir, `${dirName}.md`), renderEvalReport(report));
  if (args.baseline) {
    const baselineDir = deps.baselineDir ?? join(deps.reportDir, 'baseline');
    mkdirSync(baselineDir, { recursive: true });
    writeFileSync(join(baselineDir, `${dirName}.json`), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(baselineDir, `${dirName}.md`), renderEvalReport(report));
    deps.out(`linha de base gravada em ${baselineDir}`);
  }
  if (args.record) {
    const dir = join(deps.fixturesDir, dirName);
    mkdirSync(dir, { recursive: true });
    for (const [id, recorder] of recorders) writeFileSync(join(dir, `${id}.json`), `${JSON.stringify(recorder.fixture(), null, 2)}\n`);
    deps.out(`fixtures gravadas em ${dir}`);
  }
  deps.out(renderEvalReport(report));
  if (args.compare) {
    const baselineDir = deps.baselineDir ?? join(deps.reportDir, 'baseline');
    const baselinePath = join(baselineDir, `${dirName}.json`);
    if (!existsSync(baselinePath)) {
      deps.out(`erro: linha de base ausente em ${baselinePath}`);
      return 2;
    }
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as EvalReport;
    const comparison = compareBaseline(baseline, report);
    writeFileSync(join(deps.reportDir, `${dirName}.compare.json`), `${JSON.stringify(comparison, null, 2)}\n`);
    writeFileSync(join(deps.reportDir, `${dirName}.compare.md`), renderBaselineComparison(comparison));
    deps.out(renderBaselineComparison(comparison));
    return comparison.ok ? 0 : 1;
  }
  return report.ok ? 0 : 1;
}
