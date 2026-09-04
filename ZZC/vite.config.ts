import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()],base:'./',build:{target:'es2020'},server:{host:true,watch:{ignored:['**/*.zip','**/服务器部署包/**','**/dist/**']}}})
