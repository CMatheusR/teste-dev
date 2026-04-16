import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { CepService, CEP_PROVIDERS } from '../src/cep/cep.service';
import { CepCacheService } from '../src/cep/cache/cep-cache.service';
import { CircuitBreakerService } from '../src/cep/circuit-breaker/circuit-breaker.service';
import { CepProvider } from '../src/cep/providers/cep-provider.interface';
import { CepResponseDto } from '../src/cep/dto/cep-response.dto';
import { CepNotFoundException } from '../src/common/exceptions/cep-not-found.exception';
import { AllProvidersFailedException } from '../src/common/exceptions/all-providers-failed.exception';

const mockResult: CepResponseDto = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  provider: 'ProviderA',
};

const makeProvider = (name: string): jest.Mocked<CepProvider> => ({
  name,
  fetchCep: jest.fn(),
});

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('CepService', () => {
  let service: CepService;
  let providerA: jest.Mocked<CepProvider>;
  let providerB: jest.Mocked<CepProvider>;
  let cacheService: jest.Mocked<Pick<CepCacheService, 'get' | 'set'>>;
  let circuitBreaker: jest.Mocked<Pick<CircuitBreakerService, 'recordSuccess' | 'recordFailure'>>;

  beforeEach(async () => {
    providerA = makeProvider('ProviderA');
    providerB = makeProvider('ProviderB');
    cacheService = { get: jest.fn().mockReturnValue(null), set: jest.fn() };
    circuitBreaker = { recordSuccess: jest.fn(), recordFailure: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CepService,
        { provide: CEP_PROVIDERS, useValue: [providerA, providerB] },
        { provide: CepCacheService, useValue: cacheService },
        { provide: CircuitBreakerService, useValue: circuitBreaker },
        { provide: getLoggerToken(CepService.name), useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CepService>(CepService);
  });

  it('should return cached result without calling any provider', async () => {
    cacheService.get.mockReturnValue(mockResult);

    const result = await service.fetchCep('01310100');

    expect(result).toBe(mockResult);
    expect(providerA.fetchCep).not.toHaveBeenCalled();
    expect(providerB.fetchCep).not.toHaveBeenCalled();
  });

  it('should call first provider and cache result on success', async () => {
    providerA.fetchCep.mockResolvedValue(mockResult);

    const result = await service.fetchCep('01310100');

    expect(result).toEqual(mockResult);
    expect(cacheService.set).toHaveBeenCalledWith('01310100', mockResult);
  });

  it('should call recordSuccess when provider succeeds', async () => {
    providerA.fetchCep.mockResolvedValue(mockResult);

    await service.fetchCep('01310100');

    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('ProviderA');
  });

  it('should fallback to second provider when first throws a generic error', async () => {
    const fallbackResult = { ...mockResult, provider: 'ProviderB' };
    providerA.fetchCep.mockRejectedValue(new Error('Connection timeout'));
    providerB.fetchCep.mockResolvedValue(fallbackResult);

    const result = await service.fetchCep('01310100');

    expect(providerA.fetchCep).toHaveBeenCalled();
    expect(providerB.fetchCep).toHaveBeenCalled();
    expect(result.provider).toBe('ProviderB');
  });

  it('should call recordFailure when provider throws a generic error', async () => {
    providerA.fetchCep.mockRejectedValue(new Error('timeout'));
    providerB.fetchCep.mockResolvedValue(mockResult);

    await service.fetchCep('01310100');

    expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('ProviderA');
  });

  it('should NOT call recordFailure when provider throws CepNotFoundException', async () => {
    providerA.fetchCep.mockRejectedValue(new CepNotFoundException('99999999'));

    await expect(service.fetchCep('99999999')).rejects.toThrow(CepNotFoundException);

    expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
    expect(providerB.fetchCep).not.toHaveBeenCalled();
  });

  it('should throw AllProvidersFailedException when both providers fail', async () => {
    providerA.fetchCep.mockRejectedValue(new Error('timeout'));
    providerB.fetchCep.mockRejectedValue(new Error('timeout'));

    await expect(service.fetchCep('01310100')).rejects.toThrow(
      AllProvidersFailedException,
    );
  });

  it('should alternate providers via round-robin on consecutive calls', async () => {
    providerA.fetchCep.mockResolvedValue({ ...mockResult, provider: 'ProviderA' });
    providerB.fetchCep.mockResolvedValue({ ...mockResult, provider: 'ProviderB' });

    const first = await service.fetchCep('01310100');
    expect(first.provider).toBe('ProviderA');

    cacheService.get.mockReturnValue(null);

    const second = await service.fetchCep('01310200');
    expect(second.provider).toBe('ProviderB');
  });
});
