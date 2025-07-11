import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

const Layouts = (): any => import('@renderer/layouts/index.vue')

/**
 * @name 常驻路由
 * @description 除了 redirect/403/404/login 等隐藏页面，其他页面建议设置唯一的 Name 属性
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layouts,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        component: () => import('@renderer/pages/dashboard/index.vue'),
        name: 'Dashboard',
        meta: {
          title: '首页'
        }
      }
    ]
  },
  {
    path: '/403',
    component: () => import('@renderer/pages/error/403.vue'),
    meta: {
      hidden: true
    }
  },
  {
    path: '/404',
    component: () => import('@renderer/pages/error/404.vue'),
    meta: {
      hidden: true
    },
    alias: '/:pathMatch(.*)*'
  },
  {
    path: '/login',
    component: () => import('@renderer/pages/login/index.vue'),
    meta: {
      hidden: true
    }
  }
]

/** 路由实例 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes
})
