import { ServiceUnavailableException } from '@nestjs/common';

export class AllProvidersFailedException extends ServiceUnavailableException {
  constructor(cep: string) {
    super(
      `Todos os providers falharam ao consultar o CEP ${cep}. Tente novamente mais tarde.`,
    );
  }
}
