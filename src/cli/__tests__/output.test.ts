import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cliError, cliWarn, cliInfo, cliVersion, cliFatal } from '../output.js';
import pc from 'picocolors';

describe('cli output', () => {
  let stderrSpy: any;
  let exitSpy: any;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cliError should print error message', () => {
    cliError('test error');
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.red('✖')} ${pc.red(pc.bold('test error'))}\n`);
  });

  it('cliError should print error message with hint', () => {
    cliError('test error', 'try this');
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.red('✖')} ${pc.red(pc.bold('test error'))}\n`);
    expect(stderrSpy).toHaveBeenCalledWith(`  ${pc.dim('try this')}\n`);
  });

  it('cliWarn should print warning message', () => {
    cliWarn('test warn');
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.yellow('⚠')} ${pc.yellow('test warn')}\n`);
  });

  it('cliInfo should print info message', () => {
    cliInfo('test info');
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.dim('test info')}\n`);
  });

  it('cliVersion should print version message', () => {
    cliVersion('1.0.0');
    expect(stderrSpy).toHaveBeenCalledWith(`mysql-mcp ${pc.green(pc.bold('v1.0.0'))}\n`);
  });

  it('cliFatal should print error and exit', () => {
    cliFatal('fatal error');
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.red('✖')} ${pc.red(pc.bold('fatal error'))}\n`);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('cliFatal should print error with Error object and exit', () => {
    const err = new Error('details');
    cliFatal('fatal error', err);
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.red('✖')} ${pc.red(pc.bold('fatal error'))}\n`);
    expect(stderrSpy).toHaveBeenCalledWith(`  ${pc.dim('details')}\n`);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('cliFatal should print error with string details and exit', () => {
    cliFatal('fatal error', 'string details');
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.red('✖')} ${pc.red(pc.bold('fatal error'))}\n`);
    expect(stderrSpy).toHaveBeenCalledWith(`  ${pc.dim('string details')}\n`);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
  
  it('cliFatal should print error with number details and exit', () => {
    cliFatal('fatal error', 123);
    expect(stderrSpy).toHaveBeenCalledWith(`${pc.red('✖')} ${pc.red(pc.bold('fatal error'))}\n`);
    expect(stderrSpy).toHaveBeenCalledWith(`  ${pc.dim('123')}\n`);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
