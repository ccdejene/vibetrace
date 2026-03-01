import readline from 'readline';

export async function promptYesNo(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (input) => resolve(input.trim().toLowerCase()));
  });
  rl.close();
  return answer === 'y' || answer === 'yes';
}

export async function promptChoice(message, choices) {
  if (!choices.length) return null;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = `${message}\n${choices.map((choice, idx) => `  ${idx + 1}) ${choice}`).join('\n')}\nSelect a number: `;

  const answer = await new Promise((resolve) => {
    rl.question(question, (input) => resolve(input));
  });

  rl.close();
  const index = Number(answer) - 1;
  if (Number.isNaN(index) || index < 0 || index >= choices.length) {
    return null;
  }
  return index;
}
