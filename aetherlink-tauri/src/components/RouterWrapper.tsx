import React from 'react';
import { RouterProvider } from 'react-router-dom';
import BackButtonHandler from './BackButtonHandler';

interface RouterWrapperProps {
  router: any; // 使用 any 类型来避免类型问题
}

/**
 * 包装 RouterProvider 的组件，用于添加需要路由上下文的组件
 */
const RouterWrapper: React.FC<RouterWrapperProps> = ({ router }) => {
  return (
    <>
      <RouterProvider router={router} />
      <BackButtonHandler />
    </>
  );
};

export default RouterWrapper;
