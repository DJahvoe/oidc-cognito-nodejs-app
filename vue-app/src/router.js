import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import PublicView from './views/PublicView.vue'
import ProtectedView from './views/ProtectedView.vue'
import CallbackView from './views/CallbackView.vue'
import { initializeAuth, isAuthenticated, signin } from './auth/oidc'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/public-page',
    name: 'public',
    component: PublicView,
  },
  {
    path: '/protected-page',
    name: 'protected',
    component: ProtectedView,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/auth/callback',
    name: 'callback',
    component: CallbackView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'router-link-partial',
  linkExactActiveClass: 'router-link-active',
})

router.beforeEach(async (to) => {
  if (to.name === 'callback') {
    return true
  }

  await initializeAuth()

  if (to.meta.requiresAuth && !isAuthenticated()) {
    await signin(to.fullPath)
    return false
  }

  return true
})

export default router
