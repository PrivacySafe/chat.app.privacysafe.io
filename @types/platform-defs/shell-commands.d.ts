
declare namespace web3n.shell.commands {

	type StartAppWithParams = (
		appDomain: string|null, cmd: string, ...params: any[]
	) => Promise<void>;

	interface CmdParams{
		cmd: string;
		params: any[];
	}
	
	type GetStartedCmd = () => Promise<CmdParams|undefined>;

	type WatchStartCmds = (observer: Observer<CmdParams>) => (() => void);

	interface ShellCmdException extends RuntimeException {
		type: 'shell-command';
		appDomain: string;
		command: string;
		cmdNotAllowed?: true;
		callerNotAllowed?: true;
	}

}
