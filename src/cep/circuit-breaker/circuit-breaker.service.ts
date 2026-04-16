import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

interface ProviderState {
  failures: number;
  alertSent: boolean;
}

@Injectable()
export class CircuitBreakerService {
  private readonly threshold: number;
  private readonly states = new Map<string, ProviderState>();

  constructor(
    @InjectPinoLogger(CircuitBreakerService.name)
    private readonly logger: PinoLogger,
  ) {
    this.threshold = parseInt(process.env.CIRCUIT_OPEN_THRESHOLD ?? '5');
  }

  recordSuccess(providerName: string): void {
    this.states.set(providerName, { failures: 0, alertSent: false });
  }

  recordFailure(providerName: string): void {
    const state = this.states.get(providerName) ?? { failures: 0, alertSent: false };
    state.failures += 1;
    this.states.set(providerName, state);

    if (state.failures >= this.threshold && !state.alertSent) {
      state.alertSent = true;
      this.logger.error({
        event: 'cep.provider.degraded',
        provider: providerName,
        failures: state.failures,
        threshold: this.threshold,
      });
    }
  }
}
