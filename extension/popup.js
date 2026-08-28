chrome.tabs.query({active:true,currentWindow:true}, tabs => {
  const tab = tabs[0] || {};
  document.querySelector('#title').value = tab.title || '';
  document.querySelector('#url').value = tab.url || '';
  chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.getSelection()?.toString()||''}, r => {
    if (r && r[0]) document.querySelector('#selection').value = r[0].result;
  });
  document.querySelector('#save').onclick = () => {
    const item = {title:document.querySelector('#title').value,url:document.querySelector('#url').value,author:document.querySelector('#author').value,selection:document.querySelector('#selection').value,createdAt:new Date().toISOString()};
    chrome.storage.local.get({sources:[]}, data => chrome.storage.local.set({sources:[item,...data.sources]},()=>document.querySelector('#status').textContent='Saved in extension storage. Connect to the Next.js API for production persistence.'));
  };
});
