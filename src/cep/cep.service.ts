import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CepProvider } from './providers/cep-provider.interface';
import { CepResponseDto } from './dto/cep-response.dto';
import { CepCacheService } from './cache/cep-cache.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { CepNotFoundException } from '../common/exceptions/cep-not-found.exception';
import { AllProvidersFailedException } from '../common/exceptions/all-providers-failed.exception';

export const CEP_PROVIDERS = 'CEP_PROVIDERS';

@Injectable()
export class CepService {
  private providerIndex = 0;

  constructor(
    @Inject(CEP_PROVIDERS) private readonly providers: CepProvider[],
    private readonly cacheService: CepCacheService,
    private readonly circuitBreaker: CircuitBreakerService,
    @InjectPinoLogger(CepService.name) private readonly logger: PinoLogger,
  ) {}

  async fetchCep(cep: string): Promise<CepResponseDto> {
    const cached = this.cacheService.get(cep);

    if (cached) {
      this.logger.info({ event: 'cep.cache.hit', cep });

      return cached;
    }

    this.logger.info({ event: 'cep.cache.miss', cep });

    const startIndex = this.providerIndex % this.providers.length;

    this.providerIndex++;

    const ordered = this.providers.map(
      (_, i) => this.providers[(startIndex + i) % this.providers.length],
    );

    for (let i = 0; i < ordered.length; i++) {
      const provider = ordered[i];
      const start = Date.now();
      this.logger.info({ event: 'cep.fetch.attempt', provider: provider.name, cep });

      try {
        const result = await provider.fetchCep(cep);
        const durationMs = Date.now() - start;

        this.logger.info({ event: 'cep.fetch.success', provider: provider.name, cep, durationMs });
        this.circuitBreaker.recordSuccess(provider.name);
        this.cacheService.set(cep, result);

        return result;
      } catch (error) {
        const durationMs = Date.now() - start;

        if (error instanceof CepNotFoundException) {
          this.logger.info({ event: 'cep.fetch.not_found', provider: provider.name, cep });
          throw error;
        }

        this.logger.warn({
          event: 'cep.fetch.error',
          provider: provider.name,
          cep,
          error: error.message,
          durationMs,
        });

        this.circuitBreaker.recordFailure(provider.name);

        if (i < ordered.length - 1) {
          this.logger.warn({
            event: 'cep.fetch.fallback',
            fromProvider: provider.name,
            toProvider: ordered[i + 1].name,
            cep,
          });
        }
      }
    }

    this.logger.error({ event: 'cep.fetch.all_failed', cep });
    throw new AllProvidersFailedException(cep);
  }
}
