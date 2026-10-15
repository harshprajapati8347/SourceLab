type LogFields = Record<string, unknown>;

function write(
  level: "info" | "debug" | "warn",
  fieldsOrMessage: LogFields | string,
  message?: string,
) {
  if (typeof fieldsOrMessage === "string") {
    console[level](fieldsOrMessage);
    return;
  }

  console[level](message ?? level, fieldsOrMessage);
}

export const logger = {
  info(fieldsOrMessage: LogFields | string, message?: string) {
    write("info", fieldsOrMessage, message);
  },
  debug(fieldsOrMessage: LogFields | string, message?: string) {
    write("debug", fieldsOrMessage, message);
  },
  warn(fieldsOrMessage: LogFields | string, message?: string) {
    write("warn", fieldsOrMessage, message);
  },
};
