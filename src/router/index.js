import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/detail/:symbol',
    name: 'StockDetail',
    component: () => import('@/views/StockDetail.vue')
  },
  {
    path: '/company-parser',
    name: 'CompanyParser',
    component: () => import('@/views/CompanyParser.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
