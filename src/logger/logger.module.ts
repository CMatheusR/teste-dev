import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

const logFile = process.env.LOG_FILE;
const isProd = process.env.NODE_ENV === 'production';

const targets: object[] = [];

if (!isProd) {
  targets.push({ target: 'pino-pretty', options: { singleLine: true }, level: process.env.LOG_LEVEL ?? 'info' });
}

if (logFile) {
  targets.push({ target: 'pino/file', options: { destination: logFile, mkdir: true }, level: process.env.LOG_LEVEL ?? 'info' });
}

const transport: any = targets.length > 0 ? { targets } : undefined;

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport,
      },
    }),
  ],
})
export class LoggerModule {}
