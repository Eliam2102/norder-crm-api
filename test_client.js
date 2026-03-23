import prisma from './src/lib/prisma.js';

async function main() {
  console.log('Checking prisma.platillo...');
  if (prisma.platillo) {
    console.log('Success: prisma.platillo is defined!');
  } else {
    console.log('Error: prisma.platillo is UNDEFINED');
    console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('_')));
  }
  process.exit(0);
}

main();
