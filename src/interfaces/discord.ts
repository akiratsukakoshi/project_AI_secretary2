import { Message, User, Channel } from 'discord.js';

export interface DiscordContext {
  message: Message;
  user: User;
  channel: Channel;
  command?: string;
  args?: string[];
}

export interface CommandHandler {
  name: string;
  description: string;
  handler: (context: DiscordContext) => Promise<void>;
}