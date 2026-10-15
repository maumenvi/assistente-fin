/**
 * O que fazer com o lembrete diario (spec 022, FR-030). Dias no padrao do Android/Expo:
 * 1 = domingo ... 7 = sabado.
 */
export type DailyReminderPlan =
  | { readonly action: 'cancel' }
  | {
      readonly action: 'schedule';
      readonly title: string;
      readonly body: string;
      readonly hour: number;
      readonly minute: number;
      readonly weekdays: readonly number[];
    };
