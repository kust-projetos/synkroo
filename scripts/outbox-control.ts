import { closeDb } from '@/lib/db/client';
import {
  getOutboxControlStatus,
  OutboxControlError,
  pauseOutboxConsumption,
  resumeOutboxConsumption,
} from '@/lib/outbox/control';

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(3).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function printStatus(status: Awaited<ReturnType<typeof getOutboxControlStatus>>): void {
  // Somente códigos, IDs aleatórios, versões e contagens; sem payload, erros
  // livres, PII ou connection strings.
  console.log(`OUTBOX_CONTROL_STATUS=${JSON.stringify(status)}`);
}

async function main(): Promise<number> {
  const [action] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) {
    console.error('OUTBOX_CONTROL_ERROR=DATABASE_URL_REQUIRED');
    return 2;
  }

  try {
    if (action === 'status') {
      printStatus(await getOutboxControlStatus());
      return 0;
    }

    if (action === 'pause') {
      const status = await pauseOutboxConsumption({ reason: 'e2b-maintenance' });
      printStatus(await getOutboxControlStatus());
      console.log(`OUTBOX_PAUSE_EPOCH=${status.epoch}`);
      return 0;
    }

    if (action === 'verify-drained') {
      const status = await getOutboxControlStatus();
      printStatus(status);
      if (!status.paused || !status.drained || !status.processingJobsComplete) {
        console.error('OUTBOX_DRAIN=INCOMPLETE');
        return 1;
      }
      console.log('OUTBOX_DRAIN=VERIFIED');
      return 0;
    }

    if (action === 'resume') {
      const rawEpoch = option('expected-epoch');
      const epoch = rawEpoch === undefined ? Number.NaN : Number(rawEpoch);
      const releaseId = option('release-id');
      const status = await resumeOutboxConsumption({ expectedEpoch: epoch, releaseId });
      printStatus(await getOutboxControlStatus());
      console.log(`OUTBOX_RESUMED_EPOCH=${status.epoch}`);
      return 0;
    }

    console.error('Usage: outbox:control <status|pause|verify-drained|resume --expected-epoch=N --release-id=ID>');
    return 2;
  } catch (error) {
    if (error instanceof OutboxControlError) {
      console.error(`OUTBOX_CONTROL_ERROR=${error.code}`);
      return 1;
    }
    // Erro bruto do driver pode incluir DSN/SQL/payload: não imprimir.
    console.error('OUTBOX_CONTROL_ERROR=UNAVAILABLE');
    return 1;
  } finally {
    await closeDb();
  }
}

main().then((code) => process.exit(code));
