import { type PdfTextPort } from '../../attachment/ports/pdf.text.port.ts';
import { type FileAccessPort } from '../../ports/files/file.access.port.ts';
import { type GitProbePort } from '../../ports/files/git.probe.port.ts';

/** O que as ferramentas de arquivo precisam do computador (injetado pelo desktop; o app Android nao tem). */
export interface FileToolDeps {
  readonly files: FileAccessPort;
  readonly git: GitProbePort;
  readonly pdf?: PdfTextPort | undefined;
}
