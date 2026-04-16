import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { BrasilApiProvider } from '../src/cep/providers/brasilapi.provider';
import { CepNotFoundException } from '../src/common/exceptions/cep-not-found.exception';

const axiosResponse = (data: unknown, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

describe('BrasilApiProvider', () => {
  let provider: BrasilApiProvider;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrasilApiProvider,
        { provide: HttpService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    provider = module.get<BrasilApiProvider>(BrasilApiProvider);
    httpService = module.get(HttpService);
  });

  it('should map BrasilAPI response to CepResponseDto', async () => {
    httpService.get.mockReturnValue(
      of(
        axiosResponse({
          cep: '01310100',
          state: 'SP',
          city: 'São Paulo',
          neighborhood: 'Bela Vista',
          street: 'Avenida Paulista',
        }),
      ),
    );

    const result = await provider.fetchCep('01310100');

    expect(result).toEqual({
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      provider: 'BrasilAPI',
    });
  });

  it('should call correct BrasilAPI URL', async () => {
    httpService.get.mockReturnValue(
      of(
        axiosResponse({
          cep: '01310100',
          state: 'SP',
          city: 'São Paulo',
          neighborhood: 'Bela Vista',
          street: 'Av. Paulista',
        }),
      ),
    );

    await provider.fetchCep('01310100');

    expect(httpService.get).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cep/v1/01310100',
    );
  });

  it('should throw CepNotFoundException on 404', async () => {
    const error = new AxiosError('Not Found', 'ERR_BAD_RESPONSE');
    error.response = { status: 404, data: {}, headers: {}, statusText: 'Not Found', config: { headers: new AxiosHeaders() } };
    httpService.get.mockReturnValue(throwError(() => error));

    await expect(provider.fetchCep('99999999')).rejects.toThrow(
      CepNotFoundException,
    );
  });

  it('should rethrow on network/timeout error', async () => {
    const error = new AxiosError('timeout', 'ECONNABORTED');
    httpService.get.mockReturnValue(throwError(() => error));

    await expect(provider.fetchCep('01310100')).rejects.toThrow(AxiosError);
  });
});
