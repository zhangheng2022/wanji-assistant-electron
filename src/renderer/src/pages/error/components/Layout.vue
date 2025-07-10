<template>
  <div class="error">
    <div class="error-svg">
      <slot />
    </div>
    <router-link to="/">
      <el-button type="primary"> 回到首页 </el-button>
    </router-link>
  </div>
</template>
