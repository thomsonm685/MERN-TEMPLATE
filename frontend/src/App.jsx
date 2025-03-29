import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from './pages/Home';

function App() {

  return (
    <>
    {/* <h1>HI</h1> */}
    <BrowserRouter>
      <Routes>
          <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App
