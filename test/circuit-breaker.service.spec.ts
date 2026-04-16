import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { CircuitBreakerService } from '../src/cep/circuit-breaker/circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let mockLogger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    delete process.env.CIRCUIT_OPEN_THRESHOLD;
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: getLoggerToken(CircuitBreakerService.name), useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should not emit alert before reaching threshold', () => {
    service.recordFailure('ViaCEP');
    service.recordFailure('ViaCEP');
    service.recordFailure('ViaCEP');
    service.recordFailure('ViaCEP');

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should emit error log exactly when threshold is reached', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('ViaCEP');
    }

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith({
      event: 'cep.provider.degraded',
      provider: 'ViaCEP',
      failures: 5,
      threshold: 5,
    });
  });

  it('should not repeat alert after threshold is reached', () => {
    for (let i = 0; i < 8; i++) {
      service.recordFailure('ViaCEP');
    }

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('should reset counter and alertSent after success', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('ViaCEP');
    }

    service.recordSuccess('ViaCEP');

    for (let i = 0; i < 4; i++) {
      service.recordFailure('ViaCEP');
    }
    expect(mockLogger.error).toHaveBeenCalledTimes(1);

    service.recordFailure('ViaCEP');
    expect(mockLogger.error).toHaveBeenCalledTimes(2);
  });

  it('should read threshold from CIRCUIT_OPEN_THRESHOLD env var', async () => {
    process.env.CIRCUIT_OPEN_THRESHOLD = '3';
    const localLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: getLoggerToken(CircuitBreakerService.name), useValue: localLogger },
      ],
    }).compile();

    const localService = module.get<CircuitBreakerService>(CircuitBreakerService);

    localService.recordFailure('BrasilAPI');
    localService.recordFailure('BrasilAPI');
    expect(localLogger.error).not.toHaveBeenCalled();

    localService.recordFailure('BrasilAPI');
    expect(localLogger.error).toHaveBeenCalledWith({
      event: 'cep.provider.degraded',
      provider: 'BrasilAPI',
      failures: 3,
      threshold: 3,
    });

    await module.close();
  });

  it('should track providers independently', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('ViaCEP');
    }

    service.recordFailure('BrasilAPI');
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
