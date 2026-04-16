import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CepProvider } from './cep-provider.interface';
import { CepResponseDto } from '../dto/cep-response.dto';
import { CepNotFoundException } from '../../common/exceptions/cep-not-found.exception';

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

@Injectable()
export class ViaCepProvider implements CepProvider {
  readonly name = 'ViaCEP';

  constructor(private readonly httpService: HttpService) {}

  async fetchCep(cep: string): Promise<CepResponseDto> {
    const url = `https://viacep.com.br/ws/${cep}/json/`;
    const response = await firstValueFrom(
      this.httpService.get<ViaCepResponse>(url),
    );

    if (response.data.erro) {
      throw new CepNotFoundException(cep);
    }

    return {
      cep: response.data.cep?.replace('-', ''),
      logradouro: response.data.logradouro,
      bairro: response.data.bairro,
      cidade: response.data.localidade,
      estado: response.data.uf,
      provider: this.name,
    };
  }
}
