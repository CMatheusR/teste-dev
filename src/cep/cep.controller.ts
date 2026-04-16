import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { CepService } from './cep.service';
import { CepResponseDto } from './dto/cep-response.dto';

@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Get(':cep')
  async getCep(@Param('cep') cep: string): Promise<CepResponseDto> {
    if (!/^\d{8}$/.test(cep)) {
      throw new BadRequestException(
        'CEP deve conter exatamente 8 dígitos numéricos',
      );
    }

    return this.cepService.fetchCep(cep);
  }
}
