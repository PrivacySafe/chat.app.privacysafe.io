import { ref } from 'vue';

export function useVideo() {
  const ownPeer = ref<string[]>([]);

  const outPeer = ref<string[]>([]);

  function setOwnPear(value: string) {
    ownPeer.value.push(value);
  }


  return {
    ownPeer,
    outPeer,
    setOwnPear,
  };
}
