import 'core-js/stable'
import 'regenerator-runtime/runtime'

import Runtime, { init } from '@adobe/exc-app'
import ReactDOM from 'react-dom'

import App from './components/App'
import './index.css'

window.React = require('react')

try {
  require('./exc-runtime')
  init(bootstrapInExcShell)
} catch (e) {
  console.log('application not running in Adobe Experience Cloud Shell', e)
  bootstrapRaw()
}

function renderApp(runtime, ims) {
  const mountEl = document.getElementById('root')
  ReactDOM.render(<App runtime={runtime} ims={ims} />, mountEl)
}

function bootstrapRaw() {
  const mockRuntime = {
    on: () => {},
  }

  renderApp(mockRuntime, {})
}

function bootstrapInExcShell() {
  const runtime = Runtime()

  runtime.on('ready', ({ imsOrg, imsToken, imsProfile }) => {
    runtime.done()
    const ims = {
      org: imsOrg,
      token: imsToken,
      profile: imsProfile,
    }
    renderApp(runtime, ims)
  })

  runtime.solution = {
    icon: 'AdobeExperienceCloud',
    title: 'Badge Management',
    shortTitle: 'Badge Mgmt',
  }

  runtime.title = 'Badge Management'
}
