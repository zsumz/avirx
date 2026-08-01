import { spawnSync } from 'node:child_process';

type CommandOptions = Readonly<{
    cwd: string;
    env?: NodeJS.ProcessEnv;
}>;

export function runCommand(
    command: string,
    args: readonly string[],
    options: CommandOptions,
): string {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        encoding: 'utf8',
        env: options.env ?? process.env,
    });

    if (result.status !== 0) {
        const rendered = [result.stdout, result.stderr].filter(Boolean).join('\n');
        throw new Error([
            `Command failed: ${command} ${args.join(' ')}`,
            `cwd: ${options.cwd}`,
            rendered,
        ].filter(Boolean).join('\n'));
    }

    return result.stdout;
}
