const fs = require('fs');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  REST, 
  Routes 
} = require('discord.js');
require('dotenv').config();

// Client configurato con TUTTI gli Intents e Partials possibili
const client = new Client({
  intents: Object.keys(GatewayIntentBits).map(key => GatewayIntentBits[key]),
  partials: Object.keys(Partials).map(key => Partials[key])
});

// Collezioni per i comandi
client.commands = new Collection();        // Comandi Prefix
client.slashCommands = new Collection();   // Comandi Slash

const commandsPath = path.join(__dirname, 'commands');

/**
 * Funzione ricorsiva per caricare tutti i file .js anche nelle sottocartelle
 */
function loadCommands(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadCommands(filePath);
    } else if (file.endsWith('.js')) {
      const command = require(filePath);

      // Carica comando Prefix
      if (command.name) {
        client.commands.set(command.name, command);
      }

      // Carica comando Slash
      if (command.data && command.data.name) {
        client.slashCommands.set(command.data.name, command);
      }
    }
  }
}

// Carica tutti i comandi all'avvio
loadCommands(commandsPath);

/**
 * Registrazione automatica degli Slash Commands su Discord API
 */
async function registerSlashCommands() {
  const slashArray = [];

  client.slashCommands.forEach(cmd => {
    slashArray.push(cmd.data.toJSON());
  });

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('🔄 Registrazione degli Slash Commands in corso...');
    
    // Registrazione globale su tutti i server
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashArray }
    );

    console.log('✅ Slash Commands registrati con successo!');
  } catch (error) {
    console.error('❌ Errore durante la registrazione degli Slash Commands:', error);
  }
}

// Evento quando il Bot va online
client.once('ready', async () => {
  console.log(`🤖 Bot online come ${client.user.tag}`);
  await registerSlashCommands();
});

// Gestione dei messaggi (Comandi con Prefisso !)
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName) || 
                  client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(`Errore nel comando prefix ${commandName}:`, error);
    message.reply('❌ Si è verificato un errore durante l\'esecuzione di questo comando.');
  }
});

// Gestione delle Interazioni (Comandi Slash)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.executeSlash(interaction, client);
  } catch (error) {
    console.error(`Errore nel comando slash ${interaction.commandName}:`, error);
    const content = { content: '❌ Si è verificato un errore nell\'esecuzione del comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(content);
    } else {
      await interaction.reply(content);
    }
  }
});

// Login del Bot
client.login(process.env.TOKEN);
  
