import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { CepProvider } from './cep-provider.interface';
import { CepResponseDto } from '../dto/cep-response.dto';
import { CepNotFoundException } from '../../common/exceptions/cep-not-found.exception';

interface BrasilApiResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

@Injectable()
export class BrasilApiProvider implements CepProvider {
  readonly name = 'BrasilAPI';

  constructor(private readonly httpService: HttpService) {}

  async fetchCep(cep: string): Promise<CepResponseDto> {
    const url = `https://brasilapi.com.br/api/cep/v1/${cep}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<BrasilApiResponse>(url),
      );

      return {
        cep: response.data.cep,
        logradouro: response.data.street,
        bairro: response.data.neighborhood,
        cidade: response.data.city,
        estado: response.data.state,
        provider: this.name,
      };
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new CepNotFoundException(cep);
      }

      throw error;
    }
  }
}
