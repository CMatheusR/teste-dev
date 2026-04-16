import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { CepModule } from './cep/cep.module';

@Module({
  imports: [LoggerModule, CepModule],
})

export class AppModule {}
