import React from 'react';
import {createRoot} from 'react-dom/client';
async function boot(){
 if(new URLSearchParams(location.search).has('legacy')){const [{default:App},{createController}]=await Promise.all([import('./ui/App'),import('./runtime/client')]);createRoot(document.getElementById('root')!).render(<React.StrictMode><App controller={createController()}/></React.StrictMode>);}
 else if(new URLSearchParams(location.search).has('network')){const [{default:App},{createNetworkController}]=await Promise.all([import('./network/NetworkApp'),import('./network/client')]);createRoot(document.getElementById('root')!).render(<React.StrictMode><App controller={createNetworkController()}/></React.StrictMode>);}
 else{const [{default:App},{createFlowController}]=await Promise.all([import('./flow/App'),import('./flow/client')]);createRoot(document.getElementById('root')!).render(<React.StrictMode><App controller={createFlowController()}/></React.StrictMode>);}
}
void boot();
