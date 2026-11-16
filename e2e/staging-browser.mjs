import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.REPORT_DIR || 'test-results';
await fs.mkdir(out+'/evidence',{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
async function check(module,name,fn) {
  const start=Date.now();
  try { const detail=await fn(); results.push({module,name,status:'PASS',detail:detail||'Assertions passed',ms:Date.now()-start}); }
  catch(e) { results.push({module,name,status:'FAIL',detail:e.message.slice(0,600),ms:Date.now()-start}); }
  console.log(results.at(-1));
  await fs.writeFile(out+'/browser-results.json',JSON.stringify(results,null,2));
}
for(const [role,email,dashboard,routes] of [
 ['Admin','admin@staging.test','/admin/dashboard',['/admin/dashboard','/admin/students','/admin/supervisors','/admin/projects','/admin/projects/prj_test','/admin/create-form','/admin/form-details/frm_legacy','/admin/tasks','/admin/requests','/admin/settings']],
 ['Student leader','student1@staging.test','/dashboard',['/dashboard','/projects','/enroll','/chat','/settings']],
 ['Team member','student2@staging.test','/dashboard',['/dashboard','/projects']],
 ['Supervisor','supervisor@staging.test','/supervisor/dashboard',['/supervisor/dashboard','/supervisor/projects','/supervisor/teams/team_test','/supervisor/tasks','/supervisor/submissions/prj_test','/supervisor/settings']]
]) {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 page.setDefaultTimeout(7000);
 await check(role,'Login through UI',async()=>{
   await page.goto('http://127.0.0.1:5173/login');
   await page.locator('input[type=email]').fill(email);
   await page.locator('input[type=password]').fill('StagingOnly123!');
   await page.getByRole('button',{name:'Sign In',exact:true}).click();
   await page.waitForURL('**'+dashboard,{timeout:15000});
 });
 for(const route of routes) await check(role,'Route '+route,async()=>{
   const errors=[],bad=[];
   const onError=e=>errors.push(e.message);
   const onResponse=r=>{if(r.url().includes(':18080/api/')&&r.status()>=400) bad.push(r.status()+' '+new URL(r.url()).pathname);};
   page.on('pageerror',onError); page.on('response',onResponse);
   try {
     await page.goto('http://127.0.0.1:5173'+route);
     await page.waitForLoadState('networkidle',{timeout:12000});
     if(new URL(page.url()).pathname!==route) throw Error('Unexpected redirect: '+new URL(page.url()).pathname);
     const body=await page.locator('body').innerText();
     if(body.trim().length<80) throw Error('Empty page');
     await page.screenshot({path:out+'/evidence/'+role.replaceAll(' ','-')+route.replaceAll('/','_')+'.png',fullPage:true});
     if(errors.length||bad.length) throw Error([...errors,...bad].join('; '));
     return 'Page rendered; no JavaScript exceptions or HTTP 4xx/5xx from backend. Smoke coverage only.';
   } finally {page.off('pageerror',onError);page.off('response',onResponse);}
 });
 if(role==='Admin') {
  await check(role,'Create-form header cleanup',async()=>{
    await page.goto('http://127.0.0.1:5173/admin/create-form');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button',{name:'Create New Enroll Form'}).click();
    if(await page.getByText('Create Enrollment Form',{exact:true}).count()) throw Error('Redundant heading remains');
    await page.getByRole('button',{name:/Back/}).first().waitFor();
  });
  await check(role,'Column preferences survive hard reload',async()=>{
    await page.goto('http://127.0.0.1:5173/admin/students');
    await page.waitForLoadState('networkidle');
    await page.getByTitle('Show / hide columns').click();
    const box=page.locator('input[type=checkbox]').last();
    const before=await box.isChecked(); await box.click();
    await page.reload();await page.waitForLoadState('networkidle');
    await page.getByTitle('Show / hide columns').click();
    if(await page.locator('input[type=checkbox]').last().isChecked()===before) throw Error('Preference reset');
  });
  await check(role,'Student table refresh stays on page',async()=>{
    await page.goto('http://127.0.0.1:5173/admin/students');await page.waitForLoadState('networkidle');
    const req=page.waitForResponse(r=>r.url().includes('/api/students')&&r.status()===200);
    await page.getByTitle('Refresh student table').click();await req;
    if(!page.url().endsWith('/admin/students')) throw Error('Refresh changed route');
  });
  await check(role,'Delete student requires confirmation and Cancel preserves record',async()=>{
    await page.getByTitle('Show / hide columns').click();
    const action=page.locator('input[type=checkbox]').last();
    if(!await action.isChecked()) await action.check();
    await page.getByTitle('Show / hide columns').click();
    await page.getByTitle('Delete student',{exact:true}).first().click();
    await page.getByRole('button',{name:'Confirm Delete',exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByTitle('Delete student',{exact:true}).first().waitFor();
  });
 }
 await context.close();
}
await browser.close();
process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
