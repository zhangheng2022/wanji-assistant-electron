<script lang="ts" setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn' // Element Plus 中文包
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div>123123</div>
    <router-view />
  </el-config-provider>
</template>
