import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as nock from 'nock';
import { AppModule } from '../src/app.module';

const viaCepData = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
};

const brasilApiData = {
  cep: '01310100',
  state: 'SP',
  city: 'São Paulo',
  neighborhood: 'Bela Vista',
  street: 'Avenida Paulista',
};

describe('GET /cep/:cep (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(async () => {
    nock.enableNetConnect();
    await app.close();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should return 200 with unified CEP data', async () => {
    nock('https://viacep.com.br').get('/ws/01310100/json/').reply(200, viaCepData);
    nock('https://brasilapi.com.br').get('/api/cep/v1/01310100').reply(200, brasilApiData);

    const response = await request(app.getHttpServer())
      .get('/cep/01310100')
      .expect(200);

    expect(response.body).toMatchObject({
      logradouro: expect.any(String),
      bairro: expect.any(String),
      cidade: 'São Paulo',
      estado: 'SP',
      provider: expect.stringMatching(/^(ViaCEP|BrasilAPI)$/),
    });
  });

  it('should return 400 for CEP with letters', async () => {
    await request(app.getHttpServer()).get('/cep/0131010A').expect(400);
  });

  it('should return 400 for CEP shorter than 8 digits', async () => {
    await request(app.getHttpServer()).get('/cep/0131010').expect(400);
  });

  it('should return 404 when CEP does not exist', async () => {
    nock('https://viacep.com.br').get('/ws/99999999/json/').reply(200, { erro: true });
    nock('https://brasilapi.com.br').get('/api/cep/v1/99999999').reply(404, { message: 'CEP não encontrado' });

    await request(app.getHttpServer()).get('/cep/99999999').expect(404);
  });

  it('should return 503 when all providers fail', async () => {
    nock('https://viacep.com.br').get('/ws/01310100/json/').replyWithError('Connection refused');
    nock('https://brasilapi.com.br').get('/api/cep/v1/01310100').replyWithError('Connection refused');

    nock('https://viacep.com.br').get('/ws/01001000/json/').replyWithError('Connection refused');
    nock('https://brasilapi.com.br').get('/api/cep/v1/01001000').replyWithError('Connection refused');

    await request(app.getHttpServer()).get('/cep/01001000').expect(503);
  });

  it('should fallback to second provider when first fails', async () => {
    nock('https://viacep.com.br').get('/ws/01310100/json/').replyWithError('timeout');
    nock('https://brasilapi.com.br').get('/api/cep/v1/01310100').reply(200, brasilApiData);

    nock('https://viacep.com.br').get('/ws/01310100/json/').reply(200, viaCepData);

    const response = await request(app.getHttpServer())
      .get('/cep/01310100')
      .expect(200);

    expect(response.body.cidade).toBe('São Paulo');
  });
});
