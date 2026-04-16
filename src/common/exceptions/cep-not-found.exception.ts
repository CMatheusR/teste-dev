import { NotFoundException } from '@nestjs/common';

export class CepNotFoundException extends NotFoundException {
  constructor(cep: string) {
    super(`CEP ${cep} não encontrado`);
  }
}
