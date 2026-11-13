(() => {
  const dialog=document.querySelector('#photo-viewer');
  const fullImage=dialog.querySelector('img');
  let previousOverflow='';
  function openPhoto(link){
    const thumbnail=link.querySelector('img');
    fullImage.src=link.href;fullImage.alt=thumbnail.alt;
    previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';dialog.showModal();
  }
  document.querySelectorAll('.project-text section').forEach(section=>{
    const figures=[...section.querySelectorAll('.margin-photo')];
    if(!figures.length)return;
    const strip=document.createElement('div');strip.className='photo-strip';
    figures.forEach(figure=>{const clone=figure.cloneNode(true);clone.removeAttribute('id');strip.append(clone);});
    section.append(strip);
  });
  document.querySelectorAll('.margin-photo a').forEach(link=>{
    link.removeAttribute('target');
    link.setAttribute('aria-haspopup','dialog');
    link.addEventListener('click',event=>{event.preventDefault();openPhoto(link);});
  });
  document.querySelectorAll('.photo-reference').forEach(link=>link.addEventListener('click',event=>{
    const target=document.querySelector(link.hash)?.querySelector('a');
    if(target){event.preventDefault();openPhoto(target);}
  }));
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;fullImage.removeAttribute('src');});
})();