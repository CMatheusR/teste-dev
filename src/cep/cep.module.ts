import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from 'nestjs-pino';
import { CepController } from './cep.controller';
import { CepService, CEP_PROVIDERS } from './cep.service';
import { CepCacheService } from './cache/cep-cache.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { ViaCepProvider } from './providers/viacep.provider';
import { BrasilApiProvider } from './providers/brasilapi.provider';

@Module({
  imports: [
    HttpModule.register({
      timeout: parseInt(process.env.HTTP_TIMEOUT_MS ?? '5000'),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
  ],
  controllers: [CepController],
  providers: [
    CepCacheService,
    CircuitBreakerService,
    ViaCepProvider,
    BrasilApiProvider,
    {
      provide: CEP_PROVIDERS,
      useFactory: (viaCep: ViaCepProvider, brasilApi: BrasilApiProvider) => [
        viaCep,
        brasilApi,
      ],
      inject: [ViaCepProvider, BrasilApiProvider],
    },
    CepService,
  ],
})
export class CepModule {}
