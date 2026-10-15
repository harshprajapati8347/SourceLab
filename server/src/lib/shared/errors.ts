export class InputGuardError extends Error {
  readonly guardName: string;

  constructor(message: string, guardName: string) {
    super(message);
    this.name = "InputGuardError";
    this.guardName = guardName;
  }
}

export class OutputGuardError extends Error {
  readonly guardName: string;

  constructor(message: string, guardName: string) {
    super(message);
    this.name = "OutputGuardError";
    this.guardName = guardName;
  }
}
