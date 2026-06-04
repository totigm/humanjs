import { chromium, createHuman } from '@humanjs/playwright';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const human = await createHuman(page, {
    personality: 'careful',
    speed: 'human',
  });

  await human.goto('https://www.eventurex.com.ar/');
  await human.click('role=link[name="Eventos"]');
  await human.goto('https://www.eventurex.com.ar/eventos');
  await human.click('div:nth-of-type(4) > div > div:nth-of-type(1) > a');
  await human.goto('https://www.eventurex.com.ar/eventos/medico-a-palos-1775827780992');
  await human.click('role=link[name="Comprar entradas"]');
  await human.goto('https://www.eventurex.com.ar/eventos/medico-a-palos-1775827780992/comprar');
  await human.click('div:nth-of-type(3) > button');
  await human.click('div:nth-of-type(3) > button');
  await human.scroll({ to: 239 });
  await human.click('role=button[name="Continuar"]');

  await browser.close();
}

main();
