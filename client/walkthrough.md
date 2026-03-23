# BaixaBaixa - Automated Live Downloader

O BaixaBaixa é uma aplicação full-stack projetada para monitorar e baixar automaticamente suas lives favoritas assim que elas começam.

![Dashboard Preview](baixabaixa_dashboard_preview_1774269775936.png)

## Funcionalidades
- **Organização Total**: Escolha um **Caminho de Destino** diferente para cada canal.
- **Data e Hora Automáticas**: Lives são salvas com `[DATA-HORA]` no nome do arquivo.
- **Monitoramento em tempo real**: Detecta automaticamente o início da transmissão.
- **Download de Posts e Fotos**: Baixa automaticamente novas mídias usando `gallery-dl`.
- **Download TUDO (Batch)**: Um botão para arquivar todo o acervo histórico em melhor qualidade.

## Como Iniciar o Projeto

1.  Abra o terminal na pasta raiz do projeto: `c:\Users\Felipe\Documents\GitHub\BaixaBaixa`
2.  Execute o comando para iniciar tanto o servidor quanto a interface:
    ```powershell
    npm start
    ```
3.  Acesse o dashboard no seu navegador: `http://localhost:5173`

## 🚀 Deploy na Nuvem (Render + Rclone)

Para rodar 24h sem seu PC ligado e salvar direto no Google Drive:

### 1. Preparar o Rclone (No seu PC)
1. Instale o Rclone no seu computador.
2. Rode `rclone config` e crie um novo remote (ex: nomeie como `remote`).
3. Siga os passos para autorizar o seu Google Drive.
4. Localize seu arquivo `rclone.conf` (geralmente em `C:\Users\SEU_USUARIO\AppData\Roaming\rclone\rclone.conf`).

### 2. Configurar o Render
1. Crie um **Web Service** no Render usando o seu repositório do GitHub.
2. Em **Environment Variables**, adicione:
   - `NODE_ENV`: `production`
   - `RCLONE_CONFIG_DATA`: (Copie e cole TODO o conteúdo do seu arquivo `rclone.conf` aqui)
   - `RCLONE_REMOTE_NAME`: `remote` (ou o nome que você deu ao remote)
3. No Render, o **Runtime** deve ser **Docker**.

### 3. Ping para não Dormir
Use o [Cron-job.org](https://cron-job.org) para acessar sua URL do Render a cada 10 minutos. Isso garante que o monitoramento nunca pare!

## 📁 Como Usar o Dashboard

1.  **Caminho de Destino**: Coloque o nome da pasta no seu Drive (ex: `Lives/Gaming`).
2.  **Status**: O sistema baixará o arquivo localmente no servidor e, assim que terminar, o Rclone o enviará para a nuvem e apagará a versão do servidor.

---
Desenvolvido com foco em estética e automação total.
