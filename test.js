import fetch from 'node-fetch'; // if available, or just use http

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/pacientes'); // We need auth though!
  } catch (e) {
    console.error(e);
  }
}
test();
