<template>
  <div class="author-container">
    <a
      href="https://tieba.baidu.com/home/main?id=tb.1.9b09c627.4LoOzN6MrpCOkeuc4sLdLw?t=1769776474&fr=index#"
      target="_blank"
      class="author-link"
      rel="noopener noreferrer"
    >
      <div class="author-avatar">
        <img
          src="https://gss0.baidu.com/7Ls0a8Sm2Q5IlBGlnYG/sys/portraith/item/tb.1.9b09c627.4LoOzN6MrpCOkeuc4sLdLw?t=1767761204"
          alt="Author"
          class="avatar-img"
        />
      </div>
    </a>

    <div>
      <p>
        全套代码
        <a href="https://github.com/nyaruhodoo/r2beat-launcher" target="_blank">GitHub开源</a>
        ，无需担心账号被盗
      </p>
      <p>该工具是永远免费的(作者手痒写的)，无任何利益相关（主动打钱的除外）</p>
      <p>有什么好的建议可以向我提（做不做看心情）（你可以在贴吧找到我）</p>

      <div class="qrcode">
        <img :src="qrcode" alt="二维码" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import qrcode from '@renderer/assets/imgs/qrcode.jpg'
</script>

<style scoped>
.author-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 20px;
  text-align: center;

  .author-link {
    display: inline-block;
    text-decoration: none;
    transition: transform var(--transition-normal);
    cursor: pointer;

    &:hover {
      transform: scale(1.1);

      .author-avatar {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-button-hover);
      }
    }

    .author-avatar {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid var(--color-border);
      transition: all var(--transition-normal);
      box-shadow: var(--shadow-sm);
      background: var(--color-bg-card);
    }
  }

  .qrcode {
    margin-top: 20px;

    img {
      width: 300px;
      border-radius: 20px;
    }
  }

  a {
    text-decoration: underline;
  }
}
</style>
