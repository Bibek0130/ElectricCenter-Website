//imports
import { Routes, Route } from 'react-router-dom';
import CustomNav from './layout/MainLayout.jsx';

function App() {
    return(
        <>
            <Routes>
           <Route index element={<CustomNav />} />
           </Routes>
        </>
    );
    }
export default App;