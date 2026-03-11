import { useCallback, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { pageState, pages } from '../store';
import { useRouter, usePathname } from 'next/navigation';

const useRoute = () => {
  const [page, setPage] = useRecoilState(pageState)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if(page === "home") {
      localStorage.removeItem("previousRoutes")
    }
  } ,[page])

  const routerTo = useCallback((path: typeof pages[number]) => {
    if(pathname !== "/") {
      router.push("/")
    }

    // 获取当前存储的路径数组
    const previousRoutes = JSON.parse(localStorage.getItem('previousRoutes') || '[]');

    // 将当前路径添加到数组中
    previousRoutes.push(page);

    // 更新 localStorage
    localStorage.setItem('previousRoutes', JSON.stringify(previousRoutes));

    // 使用 setPage 跳转到新路径
    setPage(path);
    // 跳转后滚动到页面顶部
    window.scrollTo(0, 0);
  }, [page, setPage]);

  const routerBack = useCallback(() => {
    // 获取存储的路径数组
    const previousRoutes = JSON.parse(localStorage.getItem('previousRoutes') || '[]');

    // 如果数组不为空，获取上一个路径
    if (previousRoutes.length > 0) {
      const previousPath = previousRoutes.pop(); // 弹出上一个路径

      // 更新 localStorage
      localStorage.setItem('previousRoutes', JSON.stringify(previousRoutes));

      if (previousPath) {
        // 使用 setPage 跳转回上一个路径
        setPage(previousPath);
        // 跳转后滚动到页面顶部
        window.scrollTo(0, 0);
      }
    }
  }, [setPage]);

  return { routerTo, routerBack };
};

export default useRoute;
