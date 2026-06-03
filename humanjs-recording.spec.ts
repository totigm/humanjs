import { test } from '@humanjs/playwright/test';

test.use({
  humanOptions: {
    personality: 'careful',
    speed: process.env.CI ? 'instant' : 'human',
  },
});

test('recorded session', async ({ human }) => {
  await human.goto('https://www.eventurex.com.ar/');
  await human.scroll({ to: 600 });
  await human.drag(
    'role=group[name="1 de 4: Jolgorio EP2"]',
    'role=group[name="1 de 4: Jolgorio EP2"]',
  );
  await human.click('[aria-label="1 de 4: Jolgorio EP2"]');
  await human.click('role=link[name="Ver todos los eventos"]');
  await human.scroll({ to: 0 });
  await human.click('role=button[name="Comprar entradas para Jolgorio EP2"]');
  await human.click('div:nth-of-type(2) > div:nth-of-type(1) > div > div > div > div');
  await human.goto('https://www.eventurex.com.ar/eventos');
  await human.goto('https://www.eventurex.com.ar/eventos/jolgorio-ep2-1779111187430');

  // TODO: assert the outcome — add `page` to the test args and import { expect } from '@humanjs/playwright/test', e.g.:
  //   await expect(page).toHaveURL(/dashboard/);
  //   await expect(page.getByText('Welcome back')).toBeVisible();
});
