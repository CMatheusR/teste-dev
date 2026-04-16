import { CepResponseDto } from '../dto/cep-response.dto';

export interface CepProvider {
  readonly name: string;
  fetchCep(cep: string): Promise<CepResponseDto>;
}
