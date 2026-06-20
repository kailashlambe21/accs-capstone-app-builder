import React from 'react'
import { Provider, lightTheme } from '@adobe/react-spectrum'
import { ErrorBoundary } from 'react-error-boundary'
import { Route, Routes, HashRouter } from 'react-router-dom'

import ExtensionRegistration from './ExtensionRegistration'

function App(props) {
  React.useEffect(() => {
    if (props.runtime?.on) {
      props.runtime.on('configuration', ({ imsOrg, imsToken }) => {
        console.log('configuration change', { imsOrg, imsToken })
      })

      props.runtime.on('history', ({ type, path }) => {
        console.log('history change', { type, path })
      })
    }
  }, [props.runtime])

  return (
    <ErrorBoundary FallbackComponent={FallbackComponent} onError={onError}>
      <HashRouter>
        <Provider theme={lightTheme} colorScheme="light">
          <Routes>
            <Route
              index
              element={<ExtensionRegistration runtime={props.runtime} ims={props.ims} />}
            />
          </Routes>
        </Provider>
      </HashRouter>
    </ErrorBoundary>
  )

  function onError(error, componentStack) {
    console.error('App render error', error, componentStack)
  }
}

function FallbackComponent({ error, componentStack }) {
  return (
    <>
      <h1 style={{ textAlign: 'center', marginTop: '20px' }}>Something went wrong :(</h1>
      <pre>{componentStack + '\n' + error?.message}</pre>
    </>
  )
}

export default App
