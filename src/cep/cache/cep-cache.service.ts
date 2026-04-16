import {Injectable} from '@nestjs/common';
import {CepResponseDto} from '../dto/cep-response.dto';

interface CacheEntry {
  data: CepResponseDto;
  expiresAt: number;
}

@Injectable()
export class CepCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttl: number;

  constructor() {
    this.ttl = parseInt(process.env.CACHE_TTL_MS ?? '3600000');
  }

  get(cep: string): CepResponseDto | null {
    const entry = this.cache.get(cep);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cep);

      return null;
    }

    return entry.data;
  }

  set(cep: string, data: CepResponseDto): void {
    this.cache.set(cep, {
      data, expiresAt: Date.now() + this.ttl,
    });
  }
}
