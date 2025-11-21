/**
 * NotificadorTelegram.test.js
 * 
 * Testes unitários para o módulo NotificadorTelegram
 * Execute com: npm test
 */

import NotificadorTelegram from './NotificadorTelegram';

describe('NotificadorTelegram', () => {
  let notificador;

  beforeEach(() => {
    notificador = new NotificadorTelegram();
  });

  describe('gerarMensagem', () => {
    it('deve gerar mensagem para adicionar aula', () => {
      const dados = {
        assunto: 'Anatomia Humana',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Anatomia 1',
        cursos: ['Medicina', 'Enfermagem'],
        observacoes: 'Aula prática'
      };

      const mensagem = notificador.gerarMensagem(dados, 'adicionar');

      expect(mensagem).toContain('✅ Nova Aula Adicionada');
      expect(mensagem).toContain('Anatomia Humana');
      expect(mensagem).toContain('25/11/2025');
      expect(mensagem).toContain('07:00-09:10');
      expect(mensagem).toContain('Anatomia 1');
      expect(mensagem).toContain('Medicina, Enfermagem');
    });

    it('deve gerar mensagem para editar aula', () => {
      const dados = {
        assunto: 'Bioquímica',
        data: '30/11/2025',
        horario: '14:00-16:10',
        laboratorio: 'Multidisciplinar 2',
        cursos: ['Farmácia']
      };

      const mensagem = notificador.gerarMensagem(dados, 'editar');

      expect(mensagem).toContain('✏️ Aula Editada');
      expect(mensagem).toContain('Bioquímica');
    });

    it('deve gerar mensagem para excluir aula', () => {
      const dados = {
        assunto: 'Fisiologia',
        data: '22/11/2025',
        horario: '09:20-11:30',
        laboratorio: 'Fisiologia 1',
        cursos: ['Medicina']
      };

      const mensagem = notificador.gerarMensagem(dados, 'excluir');

      expect(mensagem).toContain('❌ Aula Excluída');
      expect(mensagem).toContain('Fisiologia');
    });

    it('deve formatar corretamente cursos como string', () => {
      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: ['Curso A', 'Curso B', 'Curso C']
      };

      const mensagem = notificador.gerarMensagem(dados, 'adicionar');

      expect(mensagem).toContain('Curso A, Curso B, Curso C');
    });

    it('deve lidar com dados faltantes', () => {
      const dados = {
        assunto: 'Teste'
        // Faltam outros campos
      };

      const mensagem = notificador.gerarMensagem(dados, 'adicionar');

      expect(mensagem).toContain('Teste');
      expect(mensagem).toContain('N/A'); // Campos faltantes
    });

    it('deve incluir observações quando fornecidas', () => {
      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: [],
        observacoes: 'Observação importante'
      };

      const mensagem = notificador.gerarMensagem(dados, 'adicionar');

      expect(mensagem).toContain('Observação importante');
    });

    it('não deve incluir observações quando não fornecidas', () => {
      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: []
      };

      const mensagem = notificador.gerarMensagem(dados, 'adicionar');

      expect(mensagem).not.toContain('Observações:');
    });
  });

  describe('enviarNotificacao', () => {
    it('deve retornar false se chatId não for fornecido', async () => {
      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: []
      };

      const resultado = await notificador.enviarNotificacao(null, dados, 'adicionar');

      expect(resultado).toBe(false);
    });

    it('deve retornar false se token não for configurado', async () => {
      notificador.botToken = null;

      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: []
      };

      const resultado = await notificador.enviarNotificacao('123456789', dados, 'adicionar');

      expect(resultado).toBe(false);
    });
  });

  describe('enviarParaMultiplos', () => {
    it('deve retornar 0 sucesso e 0 falha para array vazio', async () => {
      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: []
      };

      const resultado = await notificador.enviarParaMultiplos([], dados, 'adicionar');

      expect(resultado.sucesso).toBe(0);
      expect(resultado.falha).toBe(0);
    });

    it('deve retornar 0 sucesso e 0 falha para null', async () => {
      const dados = {
        assunto: 'Teste',
        data: '25/11/2025',
        horario: '07:00-09:10',
        laboratorio: 'Lab 1',
        cursos: []
      };

      const resultado = await notificador.enviarParaMultiplos(null, dados, 'adicionar');

      expect(resultado.sucesso).toBe(0);
      expect(resultado.falha).toBe(0);
    });
  });
});
