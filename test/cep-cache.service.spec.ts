import { CepCacheService } from '../src/cep/cache/cep-cache.service';
import { CepResponseDto } from '../src/cep/dto/cep-response.dto';

const mockData: CepResponseDto = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  provider: 'ViaCEP',
};

describe('CepCacheService', () => {
  let service: CepCacheService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new CepCacheService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return null for cache miss', () => {
    expect(service.get('01310100')).toBeNull();
  });

  it('should return data on cache hit', () => {
    service.set('01310100', mockData);
    expect(service.get('01310100')).toEqual(mockData);
  });

  it('should return null after TTL expiration', () => {
    process.env.CACHE_TTL_MS = '1000';
    service = new CepCacheService();
    service.set('01310100', mockData);

    jest.advanceTimersByTime(1001);

    expect(service.get('01310100')).toBeNull();
  });

  it('should remove expired entry from cache on access', () => {
    process.env.CACHE_TTL_MS = '1000';
    service = new CepCacheService();
    service.set('01310100', mockData);

    jest.advanceTimersByTime(1001);
    service.get('01310100');

    expect(service.get('01310100')).toBeNull();
  });
});
